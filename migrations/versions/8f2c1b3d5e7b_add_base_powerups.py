"""Add base_powerups to users

Revision ID: 8f2c1b3d5e7b
Revises: 8f2c1b3d5e7a
Create Date: 2026-04-06 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8f2c1b3d5e7b'
down_revision: Union[str, None] = '8f2c1b3d5e7a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('base_powerups', sa.Integer(), nullable=False, server_default='10'))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('base_powerups')
