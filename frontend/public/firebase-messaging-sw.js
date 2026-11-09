/* Only public Web configuration enters this worker. */
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.stopImmediatePropagation();
  event.waitUntil(clients.openWindow(new URL("/notifications", self.location.origin).href));
});
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js");
const config = JSON.parse(new URL(self.location.href).searchParams.get("config"));
firebase.initializeApp(config);
firebase.messaging();
self.addEventListener("install", () => self.skipWaiting());
