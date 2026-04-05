import asyncio
import sys
import uuid
import uuid
from backend.database import async_session
from backend.models import User, AllowlistedEmail
from sqlalchemy.future import select

async def seed_admin(email: str):
    async with async_session() as session:
        # First ensure they are on the allowlist
        result = await session.execute(select(AllowlistedEmail).where(AllowlistedEmail.email == email))
        if not result.scalars().first():
            print(f"Adding {email} to allowlist...")
            allowlist_entry = AllowlistedEmail(email=email)
            session.add(allowlist_entry)

        # Then check if User exists, and make them admin
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalars().first()
        
        if user:
            print(f"Found existing user {email}. Promoting to admin.")
            user.is_admin = True
        else:
            print(f"User {email} has not logged in yet. They will be an admin upon first login since we added them to the allowlist, but let's create a placeholder record just in case.")
            user_id = str(uuid.uuid4())
            new_user = User(
                id=user_id,
                google_id="placeholder",
                email=email,
                name="Admin User",
                is_admin=True
            )
            session.add(new_user)
            
        await session.commit()
        print(f"Admin seeding complete for {email}!")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python seed_admin.py <email>")
        sys.exit(1)
    
    email_to_seed = sys.argv[1]
    asyncio.run(seed_admin(email_to_seed))
