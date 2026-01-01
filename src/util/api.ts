export function get(path: string): Promise<unknown> {
  return fetch(path, {
    method: "GET",
    headers: {
      "Authorization": "Bearer " + localStorage.getItem("token"),
    }
  }).then(async res => {
    if (!res.ok) {
      throw new Error("Unable to GET: " + await res.text());
    }
    return await res.json()
  })
}

export function post(path: string, body: unknown): Promise<unknown> {
  return fetch(path, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + localStorage.getItem("token"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).then(async res => {
    if (!res.ok) {
      throw new Error("Unable to POST: " + await res.text());
    }
    return await res.json()
  })
}
