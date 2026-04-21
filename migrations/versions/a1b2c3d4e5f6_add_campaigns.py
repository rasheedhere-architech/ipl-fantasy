"""Add campaign tables

Revision ID: a1b2c3d4e5f6
Revises: 8f2c1b3d5e7c
Create Date: 2026-04-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '8f2c1b3d5e7c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'campaigns',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('status', sa.Enum('draft', 'active', 'closed', name='campaignstatus'), nullable=False, server_default='draft'),
        sa.Column('created_by', sa.String(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ends_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('non_participation_penalty', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'campaign_questions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('campaign_id', sa.String(), sa.ForeignKey('campaigns.id'), nullable=False),
        sa.Column('question_text', sa.String(), nullable=False),
        sa.Column('question_type', sa.Enum('toggle', 'multiple_choice', 'dropdown', 'free_text', 'free_number', name='questiontype'), nullable=False),
        sa.Column('options', sa.JSON(), nullable=True),
        sa.Column('correct_answer', sa.JSON(), nullable=True),
        sa.Column('scoring_rules', sa.JSON(), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'campaign_responses',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('campaign_id', sa.String(), sa.ForeignKey('campaigns.id'), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('total_points', sa.Integer(), nullable=True),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('campaign_id', 'user_id', name='uq_campaign_response_user'),
    )

    op.create_table(
        'campaign_answers',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('response_id', sa.String(), sa.ForeignKey('campaign_responses.id'), nullable=False),
        sa.Column('question_id', sa.String(), sa.ForeignKey('campaign_questions.id'), nullable=False),
        sa.Column('answer_value', sa.JSON(), nullable=False),
        sa.Column('points_awarded', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('campaign_answers')
    op.drop_table('campaign_responses')
    op.drop_table('campaign_questions')
    op.drop_table('campaigns')
    op.execute("DROP TYPE IF EXISTS campaignstatus")
    op.execute("DROP TYPE IF EXISTS questiontype")
