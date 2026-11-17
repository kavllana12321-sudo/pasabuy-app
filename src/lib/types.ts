export type Role = "customer" | "rider" | "admin";
export type Service = "pasabuy" | "pickup" | "angkas";
export type BookingStatus = "pending" | "accepted" | "picked_up" | "completed" | "cancelled";
export type User = {
  id: string; name: string; email: string; phone: string; address: string; role: Role;
  vehicle: string; plate: string; serviceArea: string;
  approved: boolean; available: boolean; createdAt: string;
};
export type Booking = {
  id: string; customerId: string; customerName: string; riderId: string | null;
  riderName: string | null; service: Service; title: string; details: string;
  pickup: string; destination: string; phone: string; fee: number;
  latitude: number | null; longitude: number | null;
  status: BookingStatus; createdAt: string; updatedAt: string;
  history: { status: BookingStatus; at: string }[];
};
export type Listing = {
  id: string; sellerId: string; sellerName: string; title: string; description: string;
  category: string; price: number; location: string; sold: boolean; createdAt: string;
  likes: string[]; comments: { id: string; userId: string; name: string; text: string; createdAt: string }[];
};
export type Message = { id: string; senderId: string; text: string; createdAt: string };
export type Conversation = {
  id: string; otherId: string; otherName: string; bookingId: string | null;
  listingId: string | null; subject: string; unread: number; messages: Message[];
};
export type Notification = { id: string; title: string; text: string; href: string; read: boolean; createdAt: string };
export type Snapshot = {
  user: User; bookings: Booking[]; listings: Listing[]; conversations: Conversation[];
  notifications: Notification[]; users: User[];
};
export const serviceLabels: Record<Service, string> = { pasabuy: "Pasabuy", pickup: "Pickup & Delivery", angkas: "Angkas" };
export const statusLabels: Record<BookingStatus, string> = { pending: "Pending", accepted: "Accepted", picked_up: "On the way", completed: "Completed", cancelled: "Cancelled" };
export const money = (amount: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
export const dateTime = (value: string) => new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(value));
export const homeFor = (role: Role) => role === "admin" ? "/admin" : role === "rider" ? "/rider" : "/customer";
