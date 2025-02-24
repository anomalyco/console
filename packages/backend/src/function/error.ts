export const handler = async () => {
  console.log("started", new Date());
  console.error(new Error("logged a different error"));
  return {
    statusCode: 200,
    body: "ok",
  };
};
