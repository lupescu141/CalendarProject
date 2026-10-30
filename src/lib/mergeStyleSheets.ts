import { StyleSheet } from "react-native";

type StyleSheetMap = Record<string, object>;

export function mergeStyleSheets<T extends StyleSheetMap, U extends StyleSheetMap>(base: T, first: U): T & U;
export function mergeStyleSheets<T extends StyleSheetMap, U extends StyleSheetMap, V extends StyleSheetMap>(
  base: T,
  first: U,
  second: V,
): T & U & V;
export function mergeStyleSheets(
  base: StyleSheetMap,
  ...overrides: StyleSheetMap[]
): StyleSheetMap {
  const merged: Record<string, object> = {};

  const keys = new Set([
    ...Object.keys(base),
    ...overrides.flatMap((override) => Object.keys(override)),
  ]);

  for (const key of keys) {
    merged[key] = StyleSheet.flatten([base[key], ...overrides.map((override) => override[key])]);
  }

  return StyleSheet.create(merged);
}
