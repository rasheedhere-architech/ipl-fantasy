"""Add is_ai to users

Revision ID: 0a0d524849a5
Revises: 8f2c1b3d5e7c
Create Date: 2026-04-16 16:40:10.196762

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0a0d524849a5'
down_revision: Union[str, None] = '8f2c1b3d5e7c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use batch_alter_table for SQLite compatibility just in case
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_ai', sa.Boolean(), nullable=False, server_default=sa.text('false')))
        
def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('is_ai')


