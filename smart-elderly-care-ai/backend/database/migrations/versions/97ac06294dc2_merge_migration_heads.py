"""merge_migration_heads

Revision ID: 97ac06294dc2
Revises: 007_remove_user_location, ffb261857ae2
Create Date: 2026-10-21 14:37:46.381104

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '97ac06294dc2'
down_revision: Union[str, Sequence[str], None] = ('007_remove_user_location', 'ffb261857ae2')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

