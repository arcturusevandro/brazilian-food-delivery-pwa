import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "npm:jose@5";

interface OrderRecord {
  id?: string;
  restaurant_id?: string;
  customer_name?: string;
  total?: number | string;
  status?: string;
}

interface DatabaseWebhookPayload {
  type?: string;
  table?: string;
  schema?: string;
  record?: OrderRecord;
  old_record?: OrderRecord | null;
}

const jsonHeaders = {
  "Content-Type": "application/json",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n").trim();
}

async function getGoogleAccessToken(
  clientEmail: string,
  privateKey: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(
    normalizePrivateKey(privateKey),
    "RS256",
  );

  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const tokenResponse = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    },
  );

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok || !tokenData.access_token) {
    console.error("Erro ao obter token Google:", tokenData);
    throw new Error("Não foi possível autenticar no Firebase.");
  }

  return tokenData.access_token as string;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "Método não permitido.",
      },
      405,
    );
  }

  try {
    const webhookSecret = Deno.env.get("ORDER_PUSH_WEBHOOK_SECRET");
    const receivedSecret = request.headers.get("x-webhook-secret");

    if (!webhookSecret || receivedSecret !== webhookSecret) {
      return jsonResponse(
        {
          success: false,
          error: "Acesso não autorizado.",
        },
        401,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const firebaseProjectId = Deno.env.get("FIREBASE_PROJECT_ID");
    const firebaseClientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");
    const firebasePrivateKey = Deno.env.get("FIREBASE_PRIVATE_KEY");

    if (
      !supabaseUrl ||
      !serviceRoleKey ||
      !firebaseProjectId ||
      !firebaseClientEmail ||
      !firebasePrivateKey
    ) {
      console.error("Segredos obrigatórios ausentes.");
      return jsonResponse(
        {
          success: false,
          error: "Configuração interna incompleta.",
        },
        500,
      );
    }

    let payload: DatabaseWebhookPayload;

    try {
      payload = (await request.json()) as DatabaseWebhookPayload;
    } catch {
      return jsonResponse(
        {
          success: false,
          error: "JSON inválido.",
        },
        400,
      );
    }

    if (
      payload.type !== "INSERT" ||
      payload.table !== "orders" ||
      !payload.record
    ) {
      return jsonResponse({
        success: true,
        ignored: true,
        reason: "Evento não corresponde à criação de pedido.",
      });
    }

    const order = payload.record;
    const restaurantId = order.restaurant_id?.trim();

    if (!restaurantId) {
      return jsonResponse(
        {
          success: false,
          error: "Pedido sem restaurante.",
        },
        400,
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const { data: subscriptions, error: subscriptionsError } =
      await supabaseAdmin
        .from("push_subscriptions")
        .select("id, token")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true);

    if (subscriptionsError) {
      console.error("Erro ao buscar aparelhos:", subscriptionsError);
      return jsonResponse(
        {
          success: false,
          error: "Não foi possível buscar os aparelhos.",
        },
        500,
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return jsonResponse({
        success: true,
        sent: 0,
        message: "Nenhum aparelho ativo cadastrado.",
      });
    }

    const accessToken = await getGoogleAccessToken(
      firebaseClientEmail,
      firebasePrivateKey,
    );

    const totalValue = Number(order.total ?? 0);
    const formattedTotal = Number.isFinite(totalValue)
      ? totalValue.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })
      : "";

    const title = "🔔 Novo pedido recebido";
    const body = order.customer_name
      ? `${order.customer_name}${formattedTotal ? ` • ${formattedTotal}` : ""}`
      : `Um novo pedido está aguardando preparo${formattedTotal ? ` • ${formattedTotal}` : ""}.`;

    const endpoint =
      `https://fcm.googleapis.com/v1/projects/${firebaseProjectId}/messages:send`;

    let sent = 0;
    let failed = 0;
    const invalidSubscriptionIds: string[] = [];

    for (const subscription of subscriptions) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: subscription.token,
            data: {
              title,
              body,
              orderId: order.id ?? "",
              order_id: order.id ?? "",
              restaurantId,
              url: "/admin",
            },
            webpush: {
              headers: {
                Urgency: "high",
                TTL: "86400",
              },
              fcm_options: {
                link: "/admin",
              },
            },
          },
        }),
      });

      if (response.ok) {
        sent += 1;
        continue;
      }

      failed += 1;
      const errorBody = await response.text();
      console.error("Erro FCM:", response.status, errorBody);

      if (
        response.status === 404 ||
        errorBody.includes("UNREGISTERED") ||
        errorBody.includes("registration-token-not-registered")
      ) {
        invalidSubscriptionIds.push(subscription.id);
      }
    }

    if (invalidSubscriptionIds.length > 0) {
      const { error: deactivateError } = await supabaseAdmin
        .from("push_subscriptions")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .in("id", invalidSubscriptionIds);

      if (deactivateError) {
        console.error("Erro ao desativar tokens inválidos:", deactivateError);
      }
    }

    return jsonResponse({
      success: true,
      sent,
      failed,
      deactivated: invalidSubscriptionIds.length,
    });
  } catch (error) {
    console.error("Erro inesperado em send-order-push:", error);

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro interno ao enviar notificações.",
      },
      500,
    );
  }
});

