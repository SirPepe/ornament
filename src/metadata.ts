import type { LifecycleCallbackName, Method, Transformer } from "./types";

export const ORNAMENT_METADATA_KEY: unique symbol = Symbol.for(
  "ORNAMENT_METADATA_KEY",
);

type Metadata = {
  tagName: string | null;
  attr: Map<string, { prop: string; transformer: Transformer<any, any> }>;
  prop: Map<
    string | symbol,
    { prop: string | symbol; transformer: Transformer<any, any> }
  >;
  method: WeakMap<Method<any, any>, Method<any, any>>;
  lifecycleDecorators: Set<LifecycleCallbackName>;
};

export function getMetadataFromContext(context: {
  readonly metadata: DecoratorMetadata;
}): Metadata {
  // This throws an exception when Symbol.metadata is not defined, which serves
  // as a reminder to include the relevant polyfills.
  return ((context.metadata[ORNAMENT_METADATA_KEY] as Metadata) ??= {
    tagName: null,
    attr: new Map(),
    prop: new Map(),
    method: new WeakMap(),
    lifecycleDecorators: new Set(),
  });
}

function getMetadataInstanceOrCtor<T>(
  instanceOrCtor: T | (new () => T),
): Partial<Metadata> {
  const ctor =
    typeof instanceOrCtor === "function"
      ? instanceOrCtor
      : instanceOrCtor?.constructor;
  return (ctor?.[Symbol.metadata] as any)?.[ORNAMENT_METADATA_KEY] ?? {};
}

export function listAttributes<T>(instanceOrCtor: T | (new () => T)): string[] {
  return [...(getMetadataInstanceOrCtor(instanceOrCtor)?.attr?.keys() ?? [])];
}

export function getAttribute<T>(
  instanceOrCtor: T | (new () => T),
  name: string,
): { prop: string; transformer: Transformer<any, any> } | null {
  return getMetadataInstanceOrCtor(instanceOrCtor)?.attr?.get(name) ?? null;
}

export function getTagName<T>(
  instanceOrCtor: T | (new () => T),
): string | null {
  return getMetadataInstanceOrCtor(instanceOrCtor)?.tagName ?? null;
}
