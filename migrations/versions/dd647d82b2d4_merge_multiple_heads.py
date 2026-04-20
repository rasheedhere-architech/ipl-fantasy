"""merge multiple heads

Revision ID: dd647d82b2d4
Revises: b2c3d4e5f6a7, dca567bd6876
Create Date: 2026-04-20 17:59:54.092513

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dd647d82b2d4'
down_revision: Union[str, None] = ('b2c3d4e5f6a7', 'dca567bd6876')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
