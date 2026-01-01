export interface Env {
  DB: D1Database;
}

const handler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    void request;
    void env;
    return new Response("InterChat worker placeholder", {
      headers: {"content-type": "text/plain; charset=utf-8"},
    });
  },
};

export default handler;
