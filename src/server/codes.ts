/** Room codes people have to read out loud, so no 0/O, 1/I/L, 5/S, 8/B. */
const ALPHABET = "ACDEFGHJKMNPQRTUVWXY2346789";
const LENGTH = 4;

export function generateCode(taken: (code: string) => boolean): string {
  // Widen the code rather than spin forever once the space gets crowded.
  for (let length = LENGTH; length <= 6; length++) {
    for (let attempt = 0; attempt < 200; attempt++) {
      let code = "";
      for (let i = 0; i < length; i++) {
        code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
      }
      if (!taken(code)) return code;
    }
  }
  throw new Error("Could not allocate a free room code");
}
