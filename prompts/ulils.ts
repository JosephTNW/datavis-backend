import fs from "fs";

export const fetchPrompt = (path: String, encoding: any) => {
  const fileContent = fs.readFileSync(
    path=String(path),
    encoding
  );

  return String(fileContent);
};