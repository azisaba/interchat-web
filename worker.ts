export interface Env {
  DB: D1Database;
}

export default {
  async fetch(_request: Request, _env: Env): Promise<Response> {
    return new Response("InterChat worker placeholder", {
      headers: {"content-type": "text/plain; charset=utf-8"},
    });
  },
};
