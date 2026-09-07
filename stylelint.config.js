export default {
  extends: ['stylelint-config-standard'],
  rules: {
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: ['tailwind', 'apply', 'layer', 'screen', 'variants', 'responsive'],
      },
    ],
    'custom-property-empty-line-before': null,
    'declaration-empty-line-before': null,
    'selector-class-pattern': null,
  },
}
