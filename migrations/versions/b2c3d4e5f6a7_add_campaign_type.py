"""Add type, is_master, is_mandatory to campaigns

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-20 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    campaign_type = sa.Enum('match', 'general', name='campaigntype')
    campaign_type.create(op.get_bind(), checkfirst=True)

    with op.batch_alter_table('campaigns', schema=None) as batch_op:
        batch_op.add_column(sa.Column('type', campaign_type, nullable=False, server_default='general'))
        batch_op.add_column(sa.Column('is_master', sa.Boolean(), nullable=False, server_default=sa.text('false')))

    with op.batch_alter_table('campaign_questions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_mandatory', sa.Boolean(), nullable=False, server_default=sa.text('false')))


def downgrade() -> None:
    with op.batch_alter_table('campaign_questions', schema=None) as batch_op:
        batch_op.drop_column('is_mandatory')

    with op.batch_alter_table('campaigns', schema=None) as batch_op:
        batch_op.drop_column('is_master')
        batch_op.drop_column('type')

    op.execute("DROP TYPE IF EXISTS campaigntype")
