from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Chapter, Volume


def ordered_chapters_statement(work_id: str):
    return (
        select(Chapter)
        .join(Volume, Chapter.volume_id == Volume.id)
        .where(Chapter.work_id == work_id)
        .order_by(Volume.order_index, Chapter.order_index)
    )


async def move_volume_to_order(
    session: AsyncSession, work_id: str, volume: Volume, target_order_index: int
) -> None:
    target_order_index = max(1, target_order_index)
    current_order_index = volume.order_index
    if target_order_index == current_order_index:
        return

    result = await session.execute(
        select(Volume).where(Volume.work_id == work_id).order_by(Volume.order_index, Volume.id)
    )
    volumes = list(result.scalars())
    volumes_by_id = {item.id: item for item in volumes}
    desired_orders = {volume.id: target_order_index}

    if target_order_index < current_order_index:
        for item in volumes:
            if item.id != volume.id and target_order_index <= item.order_index < current_order_index:
                desired_orders[item.id] = item.order_index + 1
    else:
        for item in volumes:
            if item.id != volume.id and current_order_index < item.order_index <= target_order_index:
                desired_orders[item.id] = item.order_index - 1

    temp_order_index = min(0, min((item.order_index for item in volumes), default=0)) - 1
    for item_id in desired_orders:
        volumes_by_id[item_id].order_index = temp_order_index
        temp_order_index -= 1
    await session.flush()

    for item_id, order_index in desired_orders.items():
        volumes_by_id[item_id].order_index = order_index
