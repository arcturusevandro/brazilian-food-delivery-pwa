import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RegisterPushTokenBody {
  restaurantId?: string;
  token?: string;
  deviceName?: string;
  userAgent?: string;
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

console.info("register-push-token started");

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error("Variáveis internas ausentes.");

      return jsonResponse(
        {
          success: false,
          error: "Configuração interna indisponível.",
        },
        500,
      );
    }

    const authorization = request.headers.get("Authorization");

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return jsonResponse(
        {
          success: false,
          error: "Sessão não enviada.",
        },
        401,
      );
    }

    const accessToken = authorization.replace("Bearer ", "");

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: userData,
      error: userError,
    } = await authClient.auth.getUser(accessToken);

    if (userError || !userData.user) {
      console.error("Sessão inválida:", userError);

      return jsonResponse(
        {
          success: false,
          error: "Sua sessão expirou. Saia e entre novamente no painel.",
        },
        401,
      );
    }

    let body: RegisterPushTokenBody;

    try {
      body = (await request.json()) as RegisterPushTokenBody;
    } catch {
      return jsonResponse(
        {
          success: false,
          error: "Corpo da solicitação inválido.",
        },
        400,
      );
    }

    const restaurantId = body.restaurantId?.trim();
    const token = body.token?.trim();
    const deviceName = body.deviceName?.trim().slice(0, 120) || null;
    const userAgent =
      body.userAgent?.trim().slice(0, 500) ||
      request.headers.get("user-agent")?.slice(0, 500) ||
      null;

    if (!restaurantId) {
      return jsonResponse(
        {
          success: false,
          error: "O restaurante não foi informado.",
        },
        400,
      );
    }

    if (!token || token.length < 20) {
      return jsonResponse(
        {
          success: false,
          error: "Token de notificação inválido.",
        },
        400,
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: restaurant,
      error: restaurantError,
    } = await adminClient
      .from("restaurants")
      .select("id, owner_id")
      .eq("id", restaurantId)
      .eq("owner_id", userData.user.id)
      .maybeSingle();

    if (restaurantError) {
      console.error("Erro ao validar restaurante:", restaurantError);

      return jsonResponse(
        {
          success: false,
          error: "Não foi possível validar o restaurante.",
        },
        500,
      );
    }

    if (!restaurant) {
      return jsonResponse(
        {
          success: false,
          error: "O usuário não é proprietário deste restaurante.",
        },
        403,
      );
    }

    const {
      data: subscription,
      error: subscriptionError,
    } = await adminClient
      .from("push_subscriptions")
      .upsert(
        {
          restaurant_id: restaurantId,
          token,
          device_name: deviceName,
          user_agent: userAgent,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "token",
        },
      )
      .select(
        "id, restaurant_id, device_name, is_active, created_at, updated_at",
      )
      .single();

    if (subscriptionError) {
      console.error("Erro ao salvar aparelho:", subscriptionError);

      return jsonResponse(
        {
          success: false,
          error: "Não foi possível cadastrar este aparelho.",
        },
        500,
      );
    }

    return jsonResponse({
      success: true,
      message: "Notificações ativadas neste aparelho.",
      subscription,
    });
  } catch (error) {
    console.error("Erro inesperado:", error);

    return jsonResponse(
      {
        success: false,
        error: "Erro interno ao cadastrar notificações.",
      },
      500,
    );
  }
});

