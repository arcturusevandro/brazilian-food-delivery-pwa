export default {
  extends: ['stylelint-config-standard'],
  rules: {
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: ['tailwind', 'apply', 'layer', 'screen', 'variants', 'responsive'],
      },
    ],
    'at-rule-prelude-no-invalid': [
      true,
      {
        ignoreAtRules: ['apply'],
      },
    ],
    'at-rule-empty-line-before': null,
    'font-family-name-quotes': null,
    'value-keyword-case': null,
    'hue-degree-notation': null,
    'alpha-value-notation': null,
    'custom-property-empty-line-before': null,
    'declaration-empty-line-before': null,
    'selector-class-pattern': null,
  },
}
