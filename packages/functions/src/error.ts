export const handler = async () => {
  console.error(new Error("logged error 3"));
  return {
    statusCode: 200,
    body: "ok",
  };
};
