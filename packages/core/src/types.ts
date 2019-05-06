export interface Block<M = any> {
  uuid: string;
  address: string;
  meta: M;
  timestamp: number;
  previous: string;
}

export interface Node<M = any> {
  block: Block<M>;
  address: string;
  previous: string;
}

export type Chain<M = any> = Node<M>[];

export type BlockVersion = 'v1' | 'v2' | 'v3';
