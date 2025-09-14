module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // new feature
        'fix',      // bug fix
        'docs',     // documentation only changes
        'style',    // changes that don't affect code meaning
        'refactor', // code change that neither fixes a bug nor adds a feature
        'perf',     // performance improvements
        'test',     // adding missing tests or correcting existing tests
        'build',    // changes that affect the build system or external dependencies
        'ci',       // changes to CI configuration files and scripts
        'chore',    // other changes that don't modify src or test files
        'revert'    // reverts a previous commit
      ]
    ],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never']
  }
}