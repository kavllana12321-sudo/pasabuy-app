import { performAction } from "@/lib/server/actions";
import { hash, snapshot, transaction } from "@/lib/server/database";
import { body, failure, json, requireUser, tokenFrom } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    try {
        return json(await snapshot(await requireUser(request)));
    }
    catch (error) {
        return failure(error);
    }
}
export async function POST(request: Request) {
    try {
        const data = await body(request);
        return json(await transaction(async () => await performAction(await requireUser(request), data, hash(tokenFrom(request)))));
    }
    catch (error) {
        return failure(error);
    }
}
