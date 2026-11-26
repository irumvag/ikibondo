import en from '../../messages/en.json';

export type Messages = typeof en;

type Tree = { [key: string]: string | Tree };

/** Copies `over` onto `base`, key by key, so a missing translation keeps the English text. */
export function mergeMessages(base: Tree, over: Tree): Tree {
  const out: Tree = { ...base };
  for (const [key, value] of Object.entries(over)) {
    const current = out[key];
    out[key] =
      typeof value === 'object' && typeof current === 'object'
        ? mergeMessages(current, value)
        : value;
  }
  return out;
}

export { en };
