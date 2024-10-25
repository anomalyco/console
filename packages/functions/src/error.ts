export const handler = async () => {
  console.log("starting", new Date());
  console.error(new Error("logged error 3"));
  return {
    statusCode: 200,
    body: "ok",
  };
};
