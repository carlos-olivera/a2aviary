import { compositionNames } from '../../../packages/generator/test/fixtures/presentation/compositions.mjs';
/** Pure parsing only; importing this module never reads credentials or calls providers. */
export function fixtureSelection(args) {
  let selected;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--preflight') continue;
    if (
      args[i] !== '--composition' ||
      selected !== undefined ||
      !compositionNames.includes(args[i + 1])
    )
      throw Error('invalid_fixture_composition');
    selected = args[++i];
  }
  return selected;
}
