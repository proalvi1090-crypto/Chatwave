self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : { title: "ChatWave", body: "New message" };
  event.waitUntil(
    self.registration.showNotification(payload.title || "ChatWave", {
      body: payload.body || "You received a new message",
      icon: "/icon-192.png"
    })
  );
});
