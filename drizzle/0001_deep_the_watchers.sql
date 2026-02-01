CREATE TABLE `chatMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`userId` int NOT NULL,
	`message` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chatMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `roomParticipants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`userId` int NOT NULL,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `roomParticipants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`videoTitle` varchar(255) NOT NULL,
	`platform` varchar(50) NOT NULL,
	`videoUrl` text NOT NULL,
	`videoId` varchar(255) NOT NULL,
	`currentTime` int NOT NULL DEFAULT 0,
	`isPlaying` boolean DEFAULT false,
	`duration` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rooms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `videoSyncState` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`currentTime` int NOT NULL DEFAULT 0,
	`isPlaying` boolean DEFAULT false,
	`lastSyncAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `videoSyncState_id` PRIMARY KEY(`id`),
	CONSTRAINT `videoSyncState_roomId_unique` UNIQUE(`roomId`)
);
