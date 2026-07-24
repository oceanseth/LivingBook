#!/usr/bin/env python3
# LivingBook Podcast tab spine — one generated episode:
#   news story → Actian verbatim retrieval → Band room (agent-to-agent
#   conversation record) → Masky two-avatar video episode.
#
# Run with the Hermes venv python (band_rest lives there):
#   ~/.hermes/hermes-agent/venv/bin/python3 podcast_run.py ["story context"]
# Reads BAND_* from ~/.hermes/.env and Masky vars from ../.env.
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

from band_rest import RestClient
from band_rest.types.chat_room_request import ChatRoomRequest
from band_rest.types.chat_message_request import ChatMessageRequest
from band_rest.types.chat_message_request_mentions_item import ChatMessageRequestMentionsItem
from band_rest.types.participant_request import ParticipantRequest

ASK = "http://localhost:8787"
MASKY = "https://masky.ai/api"
HOST_AVATAR = "ZzIRJNYyYn0A0N6x4oFA"      # LivingBook Host (studio mic, American Lead Actress voice)
NARRATOR_AVATAR = "H7NjYDjQYYZh5FuuqBB6"  # KJV Narrator
OWNER = "twitch:11867613"


def load_env(path):
    for line in Path(path).expanduser().read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"'))


def http_json(url, body=None, token=None, method=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method or ("POST" if data else "GET"))
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def main():
    load_env("~/.hermes/.env")
    load_env(Path(__file__).resolve().parent.parent / ".env")
    story = sys.argv[1] if len(sys.argv) > 1 else None
    if not story:
        rss = urllib.request.urlopen("https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en", timeout=30).read().decode()
        import re
        items = re.findall(r"<item>.*?<title>(.*?)</title>", rss, re.S)
        story = re.sub(r"<!\[CDATA\[|\]\]>", "", items[0]).strip()
    print("story:", story)

    # Verbatim passages from the Bible's Actian collection
    ask = http_json(f"{ASK}/api/ask", {"question": f"What does the Bible say about: {story}"})
    passages = ask.get("passages", [])[:2]
    if not passages:
        sys.exit("no passages retrieved — is the ask server up?")

    def narrator_line(p, lead):
        clean = __import__("re").sub(r"\s*\{[^}]*\}", "", p["text"])
        frame = f"{lead} From {p['ref']}: "
        quote = ""
        for s in __import__("re").findall(r"[^.;!?]+[.;!?]*\s*", clean) or [clean]:
            if len(frame) + len(quote) + len(s) > 490:
                break
            quote += s
        return frame + (quote.strip() or clean[: 490 - len(frame)])

    lines = [
        "Greetings. Today's tidings speak of: " + story[:300] + ". I have brought the word.",
        narrator_line(passages[0], "Hear what was written long ago."),
    ]
    if len(passages) > 1:
        lines.append(narrator_line(passages[1], "And consider also."))

    # Band room = the episode's agent-to-agent conversation record
    band = RestClient(api_key=os.environ["BAND_API_KEY"])
    room = band.agent_api_chats.create_agent_chat(
        chat=ChatRoomRequest(title=f"LivingBook Podcast — {story[:60]}")
    )
    room_id = getattr(getattr(room, "data", room), "id", None) or getattr(room, "id", None)
    print("band room:", room_id)

    # Two real Band agents: the producer (this process) and the Bible itself.
    bible = RestClient(api_key=os.environ["BAND_BIBLE_AGENT_KEY"])
    producer_id = os.environ["BAND_AGENT_ID"]
    bible_id = os.environ["BAND_BIBLE_AGENT_ID"]
    band.agent_api_participants.add_agent_chat_participant(
        chat_id=room_id, participant=ParticipantRequest(participant_id=bible_id)
    )

    def band_post(speaker, text):
        client, mention_id = (bible, producer_id) if speaker == "bible-kjv" else (band, bible_id)
        client.agent_api_messages.create_agent_chat_message(
            chat_id=room_id,
            message=ChatMessageRequest(
                content=f"[{speaker}] {text}",
                mentions=[ChatMessageRequestMentionsItem(id=mention_id)],
            ),
        )

    band_post("producer", f"Episode start. Story: {story}. Panel: LivingBook Host + The Holy Bible (KJV). Grounding: verbatim KJV units from Actian collection book_bible-kjv.")

    # Masky episode: host is the conversation avatar; narrator speaks via speakerAvatarId
    token = os.environ["MASKY_SERVICE_TOKEN"]
    conv = http_json(f"{MASKY}/conversations", {"avatarId": HOST_AVATAR, "avatarOwnerUserId": OWNER}, token)
    print("episode player:", conv["liveUrl"])

    for i, line in enumerate(lines):
        body = {
            "userText": line,
            "speakerAvatarId": NARRATOR_AVATAR,
            "userOutput": "video",
            "output": "video",
            "mode": "chat",
        }
        if i == len(lines) - 1:
            body["avatarText"] = (
                "That was the word itself — not my words, not anyone's spin. "
                "Follow this book on LivingBook and it will answer you too. Books that talk back."
            )
        turn = http_json(f"{MASKY}/conversations/{conv['conversationId']}/turn", body, token)
        band_post("bible-kjv", line)
        t = turn.get("turn") or {}
        print(f"turn {i + 1} injected:", t.get("id"), t.get("status"))
        time.sleep(2)

    band_post("producer", f"Episode rendered. Player: {conv['liveUrl']}")
    print("\nDone. Band room", room_id, "holds the conversation record; episode renders at the player URL above.")


if __name__ == "__main__":
    main()
