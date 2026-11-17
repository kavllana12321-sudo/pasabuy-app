import { all, get, run } from "./storage";
import { randomBytes, randomUUID } from "node:crypto";
import type { Booking, BookingStatus, Listing, Notification, Service, User } from "../types";
import { AppError, bookingById, conversationById, createConversation, hash, listingById, notify, parsed, passwordHash, passwordMatches, saveBooking, saveConversation, saveListing, saveUser, userById } from "./database";
import { boolean, numeric, password, phone, text } from "./http";
async function ownedBooking(user: User, id: string) {
    const booking = await bookingById(id);
    if (!booking)
        throw new AppError("Booking not found.", 404);
    if (user.role !== "admin" && booking.customerId !== user.id && booking.riderId !== user.id)
        throw new AppError("You cannot access this booking.", 403);
    return booking;
}
async function ownedListing(user: User, id: string) {
    const listing = await listingById(id);
    if (!listing)
        throw new AppError("Listing not found.", 404);
    if (listing.sellerId !== user.id && user.role !== "admin")
        throw new AppError("You can only manage your own listings.", 403);
    return listing;
}
async function ownConversation(user: User, id: string) {
    const conversation = await conversationById(id);
    if (!conversation)
        throw new AppError("Conversation not found.", 404);
    if (conversation.participantA !== user.id && conversation.participantB !== user.id)
        throw new AppError("You cannot access this conversation.", 403);
    return conversation;
}
async function transition(booking: Booking, status: BookingStatus) {
    const at = new Date().toISOString();
    booking.status = status;
    booking.updatedAt = at;
    booking.history.push({ status, at });
    await saveBooking(booking);
}
async function checkPassword(user: User, data: Record<string, unknown>) {
    const currentPassword = password(data, "currentPassword");
    const row = (await get("SELECT password FROM users WHERE id = ?", user.id))!;
    if (!passwordMatches(currentPassword, String(row.password)))
        throw new AppError("Current password is incorrect.", 403);
}
export async function performAction(user: User, data: Record<string, unknown>, sessionHash: string) {
    const action = text(data, "action");
    switch (action) {
        case "createBooking": {
            if (user.role !== "customer")
                throw new AppError("Only customer accounts can create bookings.", 403);
            const service = text(data, "service") as Service;
            if (!["pasabuy", "pickup", "angkas"].includes(service))
                throw new AppError("Select a valid service.");
            const title = text(data, "title", 3, 120);
            const details = text(data, "details", 3, 3000);
            const pickup = text(data, "pickup", 3, 250);
            const destination = text(data, "destination", 3, 250);
            const contact = phone(data);
            const fee = Math.round(numeric(data, "fee", 20, 10000) * 100) / 100;
            const latitude = data.latitude === undefined || data.latitude === null ? null : numeric(data, "latitude", -90, 90);
            const longitude = data.longitude === undefined || data.longitude === null ? null : numeric(data, "longitude", -180, 180);
            if ((latitude === null) !== (longitude === null))
                throw new AppError("Provide both latitude and longitude, or leave both empty.");
            const at = new Date().toISOString();
            const booking: Booking = { id: `PB-${randomBytes(5).toString("hex").toUpperCase()}`, customerId: user.id, customerName: user.name, riderId: null, riderName: null, service, title, details, pickup, destination, phone: contact, fee, latitude, longitude, status: "pending", createdAt: at, updatedAt: at, history: [{ status: "pending", at }] };
            await run("INSERT INTO bookings(id,customer_id,rider_id,status,data) VALUES(?,?,?,?,?)", booking.id, user.id, null, "pending", JSON.stringify(booking));
            await notify(user.id, "Request submitted", `${booking.title} is waiting for a rider.`, `/customer/tracking?id=${booking.id}`);
            return { id: booking.id };
        }
        case "cancelBooking": {
            const booking = await ownedBooking(user, text(data, "id"));
            if (booking.customerId !== user.id && user.role !== "admin")
                throw new AppError("Only the customer can cancel this booking.", 403);
            if (booking.status !== "pending")
                throw new AppError("Only pending requests can be cancelled. Contact your rider for an accepted request.", 409);
            await transition(booking, "cancelled");
            await notify(booking.customerId, "Request cancelled", booking.title, `/customer/tracking?id=${booking.id}`);
            return { ok: true };
        }
        case "acceptBooking": {
            if (user.role !== "rider" || !user.approved)
                throw new AppError("An approved rider account is required.", 403);
            if (!user.available)
                throw new AppError("Go online before accepting a request.", 409);
            const booking = await bookingById(text(data, "id"));
            if (!booking)
                throw new AppError("Booking not found.", 404);
            if (booking.service === "angkas" && user.vehicle.toLowerCase() !== "motorcycle")
                throw new AppError("Angkas requests require a motorcycle rider.", 403);
            if (booking.status !== "pending" || booking.riderId)
                throw new AppError("This request has already been taken or cancelled.", 409);
            if (await get("SELECT id FROM bookings WHERE rider_id = ? AND status IN ('accepted','picked_up')", user.id))
                throw new AppError("Complete your current request before accepting another.", 409);
            booking.riderId = user.id;
            booking.riderName = user.name;
            await transition(booking, "accepted");
            await createConversation(user.id, booking.customerId, `booking:${booking.id}`, booking.id, null, booking.title);
            await notify(booking.customerId, "A rider accepted your request", `${user.name} accepted ${booking.title}.`, `/customer/tracking?id=${booking.id}`);
            await notify(user.id, "Request accepted", `You accepted ${booking.title}. Message the customer to coordinate.`, `/rider`);
            return { id: booking.id };
        }
        case "advanceBooking": {
            const booking = await ownedBooking(user, text(data, "id"));
            if (user.role !== "rider" || booking.riderId !== user.id)
                throw new AppError("Only the assigned rider can update this booking.", 403);
            if (!user.approved)
                throw new AppError("Your rider account is not approved.", 403);
            const next = booking.status === "accepted" ? "picked_up" : booking.status === "picked_up" ? "completed" : null;
            if (!next)
                throw new AppError("This booking cannot advance to another status.", 409);
            await transition(booking, next);
            await notify(booking.customerId, next === "completed" ? "Request completed" : "Your rider is on the way", booking.title, `/customer/tracking?id=${booking.id}`);
            if (next === "completed")
                await notify(user.id, "Delivery completed", `${booking.title}. Collect the agreed service fee directly from the customer.`, "/rider");
            return { ok: true };
        }
        case "setAvailability": {
            if (user.role !== "rider" || !user.approved)
                throw new AppError("An approved rider account is required.", 403);
            user.available = boolean(data, "available");
            await saveUser(user);
            return { ok: true };
        }
        case "updateProfile": {
            user.name = text(data, "name", 2, 100);
            user.phone = phone(data);
            user.address = text(data, "address", 0, 250);
            if (user.role === "rider") {
                const vehicle = text(data, "vehicle", 2, 100).toLowerCase();
                if (!["motorcycle", "bicycle", "car"].includes(vehicle))
                    throw new AppError("Choose a motorcycle, bicycle, or car.");
                const plate = text(data, "plate", vehicle === "bicycle" ? 0 : 2, 30).toUpperCase();
                const serviceArea = text(data, "serviceArea", 2, 150);
                const credentialsChanged = vehicle !== user.vehicle.trim().toLowerCase() || plate !== user.plate.trim().toUpperCase() || serviceArea.toLowerCase() !== user.serviceArea.trim().toLowerCase();
                if (credentialsChanged) {
                    if (await get("SELECT id FROM bookings WHERE rider_id = ? AND status IN ('accepted','picked_up')", user.id))
                        throw new AppError("Complete your active booking before changing vehicle, plate, or service area.", 409);
                    user.approved = false;
                    user.available = false;
                    await notify(user.id, "Rider details submitted for approval", "Your vehicle or service area changed. An administrator must approve the updated details before you can go online.", "/rider");
                }
                user.vehicle = vehicle;
                user.plate = plate;
                user.serviceArea = serviceArea;
            }
            await saveUser(user);
            return { ok: true };
        }
        case "changePassword": {
            await checkPassword(user, data);
            const nextPassword = password(data);
            if (nextPassword === data.currentPassword)
                throw new AppError("Choose a different new password.");
            await run("UPDATE users SET password = ? WHERE id = ?", passwordHash(nextPassword), user.id);
            await run("DELETE FROM sessions WHERE user_id = ? AND token != ?", user.id, sessionHash);
            return { ok: true };
        }
        case "regenerateRecovery": {
            await checkPassword(user, data);
            const recoveryCode = randomBytes(16).toString("hex").match(/.{4}/g)!.join("-");
            await run("UPDATE users SET recovery = ? WHERE id = ?", hash(recoveryCode.replace(/-/g, "")), user.id);
            return { recoveryCode };
        }
        case "createListing": {
            const title = text(data, "title", 3, 120);
            const description = text(data, "description", 3, 3000);
            const category = text(data, "category", 2, 60);
            if (!["Groceries", "Food & Drinks", "Electronics", "Fashion", "Home & Living", "Others"].includes(category))
                throw new AppError("Select a valid category.");
            const price = Math.round(numeric(data, "price", 1, 1000000) * 100) / 100;
            const location = text(data, "location", 3, 200);
            const listing: Listing = { id: randomUUID(), sellerId: user.id, sellerName: user.name, title, description, category, price, location, sold: false, createdAt: new Date().toISOString(), likes: [], comments: [] };
            await run("INSERT INTO listings(id,seller_id,data) VALUES(?,?,?)", listing.id, user.id, JSON.stringify(listing));
            return { id: listing.id };
        }
        case "toggleListingSold": {
            const listing = await ownedListing(user, text(data, "id"));
            listing.sold = !listing.sold;
            await saveListing(listing);
            return { ok: true };
        }
        case "deleteListing": {
            const listing = await ownedListing(user, text(data, "id"));
            await run("DELETE FROM listings WHERE id = ?", listing.id);
            return { ok: true };
        }
        case "likeListing": {
            const listing = await listingById(text(data, "id"));
            if (!listing)
                throw new AppError("Listing not found.", 404);
            listing.likes = listing.likes.includes(user.id) ? listing.likes.filter(id => id !== user.id) : [...listing.likes, user.id];
            await saveListing(listing);
            return { ok: true };
        }
        case "commentListing": {
            const listing = await listingById(text(data, "id"));
            if (!listing)
                throw new AppError("Listing not found.", 404);
            const comment = { id: randomUUID(), userId: user.id, name: user.name, text: text(data, "text", 1, 1000), createdAt: new Date().toISOString() };
            if (listing.comments.length >= 1000)
                throw new AppError("This listing has reached its comment limit.", 409);
            listing.comments.push(comment);
            await saveListing(listing);
            if (listing.sellerId !== user.id)
                await notify(listing.sellerId, "New listing comment", `${user.name} commented on ${listing.title}.`, "/customer/marketplace");
            return { ok: true };
        }
        case "startConversation": {
            if (data.bookingId) {
                const booking = await ownedBooking(user, text(data, "bookingId"));
                if (booking.customerId !== user.id && booking.riderId !== user.id)
                    throw new AppError("Only the customer and rider can join this conversation.", 403);
                if (!booking.riderId)
                    throw new AppError("A rider must accept this booking before you can message them.", 409);
                return { id: await createConversation(booking.customerId, booking.riderId, `booking:${booking.id}`, booking.id, null, booking.title) };
            }
            const listing = await listingById(text(data, "listingId"));
            if (!listing)
                throw new AppError("Listing not found.", 404);
            if (listing.sold)
                throw new AppError("This item is already sold.", 409);
            return { id: await createConversation(user.id, listing.sellerId, `listing:${listing.id}`, null, listing.id, listing.title) };
        }
        case "sendMessage": {
            const conversation = await ownConversation(user, text(data, "id"));
            const message = { id: randomUUID(), senderId: user.id, text: text(data, "text", 1, 3000), createdAt: new Date().toISOString() };
            if (conversation.messages.length >= 10000)
                throw new AppError("This conversation has reached its message limit.", 409);
            conversation.messages.push(message);
            conversation.readAt[user.id] = message.createdAt;
            await saveConversation(conversation);
            const recipientId = conversation.participantA === user.id ? conversation.participantB : conversation.participantA;
            await notify(recipientId, `New message from ${user.name}`, message.text.slice(0, 120), `/customer/messages?id=${conversation.id}`);
            return { id: message.id };
        }
        case "readConversation": {
            const conversation = await ownConversation(user, text(data, "id"));
            conversation.readAt[user.id] = new Date().toISOString();
            await saveConversation(conversation);
            return { ok: true };
        }
        case "readNotifications": {
            const id = data.id ? text(data, "id") : null;
            const rows = id ? await all("SELECT data FROM notifications WHERE user_id = ? AND id = ?", user.id, id) : await all("SELECT data FROM notifications WHERE user_id = ?", user.id);
            if (id && !rows.length)
                throw new AppError("Notification not found.", 404);
            for (const row of rows) {
                const notification = parsed<Notification>(row)!;
                notification.read = true;
                await run("UPDATE notifications SET data = ? WHERE id = ?", JSON.stringify(notification), notification.id);
            }
            return { ok: true };
        }
        case "approveRider": {
            if (user.role !== "admin")
                throw new AppError("Administrator access is required.", 403);
            const rider = await userById(text(data, "id"));
            if (!rider || rider.role !== "rider")
                throw new AppError("Rider not found.", 404);
            const approved = boolean(data, "approved");
            if (!approved && await get("SELECT id FROM bookings WHERE rider_id = ? AND status IN ('accepted','picked_up')", rider.id))
                throw new AppError("This rider must complete their active booking before approval can be revoked.", 409);
            rider.approved = approved;
            if (!approved)
                rider.available = false;
            await saveUser(rider);
            await notify(rider.id, approved ? "Rider account approved" : "Rider approval updated", approved ? "You can now go online and accept customer requests." : "Your account is awaiting administrator approval.", "/rider");
            return { ok: true };
        }
        default: throw new AppError("Unknown action.");
    }
}
