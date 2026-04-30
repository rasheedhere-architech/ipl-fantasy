"""Rename toss_time to start_time on matches table

Revision ID: f1a2b3c4d5e6
Revises: efa48ee6e4c9
Create Date: 2026-04-30 20:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'efa48ee6e4c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('matches') as batch_op:
        batch_op.alter_column('toss_time', new_column_name='start_time')


def downgrade() -> None:
    with op.batch_alter_table('matches') as batch_op:
        batch_op.alter_column('start_time', new_column_name='toss_time')
