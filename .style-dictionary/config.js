const StyleDictionary = require('style-dictionary');
const {
  fileHeader,
  getTypeScriptType: baseGetTypeScriptType,
} = require('style-dictionary/lib/common/formatHelpers');
const yaml = require('yaml');

const sourcePath = ['src/**/*.yaml'];
const buildPath = 'dist/';
const buildFileName = 'tokens';
const options = {
  showFileHeader: false,
};

function getTypeName(type) {
  return `DesignToken${type.charAt(0).toUpperCase() + type.slice(1)}`;
}

function getTypeScriptType(value, type) {
  const rawType = baseGetTypeScriptType(value);
  return rawType === 'string' && type ? getTypeName(type) : rawType;
}

function generateTypeDefinition(types) {
  const typeDef = [
    `type Branded<T, U extends string> = T & { [key in U]: never }`,
    `type TokenType = ${types.map((token) => `'${token}'`).join(' | ')}`,
    `type DesignToken<T extends string> = T extends TokenType ? Branded<string, T | 'designToken'> : never`,
    ...types.map(
      (token) => `export type ${getTypeName(token)} = DesignToken<'${token}'>`
    ),
  ];
  return typeDef.join('\n') + '\n\n';
}

function injectComment(content, comment) {
  const jsdoc = comment ? `/** ${comment} */\n` : '';
  return jsdoc + content + '\n';
}

StyleDictionary.registerTransform({
  name: 'attribute/cti-custom',
  type: 'attribute',
  transformer: function (token) {
    const attrNames = ['category', 'type', 'item', 'theme', 'subitem', 'state'];
    const originalAttrs = token.attributes || {};
    const generatedAttrs = {};

    for (let i = 0; i < token.path.length && i < attrNames.length; i++) {
      generatedAttrs[attrNames[i]] = token.path[i];
    }

    return Object.assign(generatedAttrs, originalAttrs);
  },
});

StyleDictionary.registerFormat({
  name: 'javascript/es6-jsdoc',
  formatter: ({ dictionary, file }) =>
    fileHeader({ file }) +
    dictionary.allTokens
      .map((token) =>
        injectComment(
          `export const ${token.name} = ${JSON.stringify(token.value)};`,
          token.comment
        )
      )
      .join('\n'),
});

StyleDictionary.registerFormat({
  name: 'typescript/es6-declarations-jsdoc-with-branded-type',
  formatter: ({ dictionary, file }) => {
    const types = new Set();
    const tokens = dictionary.allProperties.map((prop) => {
      const category = prop.original.attributes?.category;
      if (category) types.add(category);
      return injectComment(
        `export const ${prop.name}: ${getTypeScriptType(
          prop.value,
          category
        )};`,
        prop.comment
      );
    });
    return (
      fileHeader({ file }) +
      generateTypeDefinition(Array.from(types)) +
      tokens.join('\n')
    );
  },
});

module.exports = {
  parsers: [
    {
      pattern: /\.yaml$/,
      parse: ({ contents }) => yaml.parse(contents),
    },
  ],
  source: sourcePath,
  platforms: {
    scss: {
      transforms: [
        'attribute/cti-custom',
        'name/cti/kebab',
        'time/seconds',
        'content/icon',
        'size/rem',
        'color/css',
      ],
      buildPath,
      files: [
        {
          destination: `_${buildFileName}.scss`,
          format: 'scss/variables',
        },
      ],
      options,
    },
    typescript: {
      transforms: [
        'attribute/cti-custom',
        'name/cti/pascal',
        'time/seconds',
        'size/rem',
        'color/css',
      ],
      buildPath,
      files: [
        {
          format: 'javascript/es6-jsdoc',
          destination: `${buildFileName}.js`,
        },
        {
          format: 'typescript/es6-declarations-jsdoc-with-branded-type',
          destination: `${buildFileName}.d.ts`,
        },
        {
          format: 'javascript/module',
          destination: `${buildFileName}.module.js`,
        },
        {
          format: 'typescript/module-declarations',
          destination: `${buildFileName}.module.d.ts`,
        },
      ],
      options,
    },
  },
};
