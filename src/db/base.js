// src/db/base.js — wspólny BaseStore (C2): jedno miejsce na dostęp do IndexedDB.
import { initDB } from "./index.js";

export class BaseStore {
  constructor(storeName) {
    this.storeName = storeName;
  }

  async _db() {
    return initDB();
  }

  async get(id) {
    return (await this._db()).get(this.storeName, id);
  }

  async put(record) {
    return (await this._db()).put(this.storeName, record);
  }

  async delete(id) {
    return (await this._db()).delete(this.storeName, id);
  }

  async getAll() {
    return (await this._db()).getAll(this.storeName);
  }

  async getAllFromIndex(indexName, value) {
    return (await this._db()).getAllFromIndex(this.storeName, indexName, value);
  }
}
