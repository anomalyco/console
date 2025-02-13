import * as relaxed from "relaxed-json";

export function extractJSON(input: string) {
  const stack = [] as any[];
  const results = [];
  let startIdx = 0;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (char === "{") {
      stack.push("{");
      if (stack.length === 1) {
        startIdx = i;
      }
    }

    if (char === "}") {
      stack.pop();
      if (stack.length === 0) {
        try {
          const jsonString = input.substring(startIdx, i + 1);
          const jsonObj = relaxed.parse(jsonString);
          results.push(jsonObj as any);
        } catch (e) {}
      }
    }
  }

  return results;
}
