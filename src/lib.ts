export function tagNameFromConstructor(ctor: CustomElementConstructor): string {
  if (!ctor.name) {
    return "";
  }
  const parts = Array.from(
    ctor.name.matchAll(/(?:[a-z]+|[A-Z][a-z]+|(?:[A-Z](?![a-z]))+|[0-9]+)/g)
  ).flat();
  if (parts.length < 2) {
    return "";
  }
  return parts.map((part) => part.toLowerCase()).join("-");
}
