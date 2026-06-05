export async function requestNotificationPermission() {
  if ("Notification" in window) {
    await Notification.requestPermission();
  }
}

export function showNotification(
  title,
  body
) {
  if (Notification.permission === "granted") {
    new Notification(title, { body });
  }
}