"""
create_template.py — Crée ou met à jour un AgentTemplate (poste) en base.

Outil admin générique — ne connaît aucun rôle métier en dur. Tu passes les
infos en ligne de commande, le script s'occupe du reste.

Schéma réel de agent_templates (voir app/db/models/agent.py) :
    id, role, display_name, description, personality, skills (json),
    tools (json), docker_image (NOT NULL), is_active, created_at

Note : le quota journalier (daily_action_limit) NE vit PAS sur le template.
Il dépend du plan acheté et vit sur AgentInstance — ce script ne le touche
donc jamais.

Usage — création / mise à jour complète :
    python create_template.py --role sales_development \
        --display-name "Sales Development Representative" \
        --description "Qualifies leads, runs outreach, books meetings." \
        --personality "Confident, warm, never pushy" \
        --skills lead_qualification,cold_outreach,meeting_booking \
        --tools gmail,linkedin,calendly \
        --docker-image opexyn-sales

Pour désactiver un poste (le retirer de la Marketplace sans le supprimer) :
    python create_template.py --role sales_development --deactivate

Pour le réactiver :
    python create_template.py --role sales_development --activate
"""

import os
import json
import argparse
import uuid
from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set — check your .env file")

engine = create_engine(DATABASE_URL)


def _parse_csv_list(value):
    """'a, b, c' → ['a', 'b', 'c']. None/'' → []."""
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def upsert_template(
    role: str,
    display_name: str,
    description: str,
    personality: str,
    skills: list,
    tools: list,
    docker_image: str,
    is_active: bool,
):
    skills_json = json.dumps(skills)
    tools_json = json.dumps(tools)

    with engine.connect() as conn:
        existing = conn.execute(
            text("SELECT id FROM agent_templates WHERE role = :role"),
            {"role": role}
        ).fetchone()

        if existing:
            conn.execute(text("""
                UPDATE agent_templates
                SET display_name = :display_name,
                    description = :description,
                    personality = :personality,
                    skills = :skills,
                    tools = :tools,
                    docker_image = :docker_image,
                    is_active = :is_active
                WHERE role = :role
            """), {
                "role": role,
                "display_name": display_name,
                "description": description,
                "personality": personality,
                "skills": skills_json,
                "tools": tools_json,
                "docker_image": docker_image,
                "is_active": is_active,
            })
            conn.commit()
            print(f"✓ Updated template '{role}' (id: {existing[0]})")
        else:
            new_id = str(uuid.uuid4())
            conn.execute(text("""
                INSERT INTO agent_templates
                    (id, role, display_name, description, personality, skills, tools, docker_image, is_active)
                VALUES
                    (:id, :role, :display_name, :description, :personality, :skills, :tools, :docker_image, :is_active)
            """), {
                "id": new_id,
                "role": role,
                "display_name": display_name,
                "description": description,
                "personality": personality,
                "skills": skills_json,
                "tools": tools_json,
                "docker_image": docker_image,
                "is_active": is_active,
            })
            conn.commit()
            print(f"✓ Created template '{role}' (id: {new_id})")


def set_active(role: str, is_active: bool):
    with engine.connect() as conn:
        result = conn.execute(
            text("UPDATE agent_templates SET is_active = :a WHERE role = :role"),
            {"a": is_active, "role": role}
        )
        conn.commit()
        if result.rowcount == 0:
            print(f"⚠️  No template found for role '{role}'")
        else:
            status = "activated" if is_active else "deactivated"
            print(f"✓ Template '{role}' {status}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--role", required=True, help="Role identifier, e.g. sales_development, ops_admin")
    parser.add_argument("--display-name", help="Name shown in the Marketplace, e.g. 'Sales Development Representative'")
    parser.add_argument("--description", default="", help="Short description shown in the Marketplace")
    parser.add_argument("--personality", default="", help="Short personality descriptor, e.g. 'Confident, warm, never pushy'")
    parser.add_argument("--skills", default="", help="Comma-separated list, e.g. lead_qualification,cold_outreach,meeting_booking")
    parser.add_argument("--tools", default="", help="Comma-separated list, e.g. gmail,linkedin,calendly")
    parser.add_argument("--docker-image", help="Docker image tag for this role, e.g. opexyn-sales")
    parser.add_argument("--activate", action="store_true", help="Activate this template (show in Marketplace)")
    parser.add_argument("--deactivate", action="store_true", help="Deactivate this template (hide from Marketplace)")
    args = parser.parse_args()

    if args.deactivate:
        set_active(args.role, False)
    elif args.activate:
        set_active(args.role, True)
    else:
        if not args.display_name:
            raise SystemExit("--display-name is required when creating/updating a template")
        if not args.docker_image:
            raise SystemExit("--docker-image is required when creating/updating a template (column is NOT NULL)")

        upsert_template(
            role=args.role,
            display_name=args.display_name,
            description=args.description,
            personality=args.personality,
            skills=_parse_csv_list(args.skills),
            tools=_parse_csv_list(args.tools),
            docker_image=args.docker_image,
            is_active=True,
        )