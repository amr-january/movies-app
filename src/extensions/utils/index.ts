import { ObjectLiteral, SelectQueryBuilder } from "typeorm";

export function handleOrderBy<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, orderBy: string) {
    for (const order of orderBy.split(',')) {
        if (order.charAt(0) === '-') qb.orderBy(order.slice(1), 'DESC');
        else qb.orderBy(order, 'ASC');
    }

    return qb
}