import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  rooms,
  roomParticipants,
  chatMessages,
  videoSyncState,
  InsertRoom,
  InsertRoomParticipant,
  InsertChatMessage,
  InsertVideoSyncState,
  Room,
  RoomParticipant,
  ChatMessage,
  VideoSyncState,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============ ROOMS ============

export async function createRoom(data: InsertRoom): Promise<Room> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(rooms).values(data);
  const roomId = Number((result as any).insertId);

  // Create video sync state for the room
  await db.insert(videoSyncState).values({
    roomId: Number(roomId),
    currentTime: 0,
    isPlaying: false,
  });

  const room = await db.select().from(rooms).where(eq(rooms.id, Number(roomId))).limit(1);
  return room[0];
}

export async function getRooms(): Promise<Room[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(rooms).orderBy(desc(rooms.createdAt));
}

export async function getRoomById(id: number): Promise<Room | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
  return result[0] || null;
}

export async function updateRoom(id: number, data: Partial<InsertRoom>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(rooms).set(data).where(eq(rooms.id, id));
}

export async function deleteRoom(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete all related data
  await db.delete(chatMessages).where(eq(chatMessages.roomId, id));
  await db.delete(roomParticipants).where(eq(roomParticipants.roomId, id));
  await db.delete(videoSyncState).where(eq(videoSyncState.roomId, id));
  await db.delete(rooms).where(eq(rooms.id, id));
}

// ============ ROOM PARTICIPANTS ============

export async function addParticipant(data: InsertRoomParticipant): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if already a participant
  const existing = await db
    .select()
    .from(roomParticipants)
    .where(and(eq(roomParticipants.roomId, data.roomId), eq(roomParticipants.userId, data.userId)))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(roomParticipants).values(data);
  }
}

export async function removeParticipant(roomId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(roomParticipants)
    .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userId, userId)));
}

export async function getRoomParticipants(roomId: number): Promise<RoomParticipant[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(roomParticipants).where(eq(roomParticipants.roomId, roomId));
}

export async function getRoomParticipantCount(roomId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .select()
    .from(roomParticipants)
    .where(eq(roomParticipants.roomId, roomId));

  return result.length;
}

// ============ CHAT MESSAGES ============

export async function sendMessage(data: InsertChatMessage): Promise<ChatMessage> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(chatMessages).values(data);
  const messageId = Number((result as any).insertId);

  const message = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.id, Number(messageId)))
    .limit(1);

  return message[0];
}

export async function getRoomMessages(roomId: number, limit: number = 50): Promise<ChatMessage[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.roomId, roomId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
}

// ============ VIDEO SYNC STATE ============

export async function getVideoSyncState(roomId: number): Promise<VideoSyncState | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(videoSyncState)
    .where(eq(videoSyncState.roomId, roomId))
    .limit(1);

  return result[0] || null;
}

export async function updateVideoSyncState(
  roomId: number,
  data: Partial<InsertVideoSyncState>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getVideoSyncState(roomId);
  if (existing) {
    await db
      .update(videoSyncState)
      .set(data)
      .where(eq(videoSyncState.roomId, roomId));
  } else {
    await db.insert(videoSyncState).values({
      roomId,
      currentTime: data.currentTime || 0,
      isPlaying: data.isPlaying || false,
    });
  }
}
