// This library has to consider null and undefined to be actual values that were
// set deliberately and this needs its own third way to define a value as truly
// not existing.
export const NO_VALUE: unique symbol = Symbol.for("ORNAMENT_NO_VALUE");
