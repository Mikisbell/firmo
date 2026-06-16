import { Prisma } from "@prisma/client";
import { ParkEvent } from "@/src/core/domain/events";

export type ProjectionHandler = (
    tx: Prisma.TransactionClient, 
    event: ParkEvent
) => Promise<boolean | void>;
