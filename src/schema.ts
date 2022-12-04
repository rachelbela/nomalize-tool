interface EntityParams {
  [propName: string]: any;
}
interface EntityConfig {
  idAttribute?: string;
}
interface Input {
  [propName: string]: any;
}
export class SchemaEntity {
  name: string;
  primaryKey: string;
  foreignKey: EntityParams;
  constructor(name?: any, entityParams?: EntityParams, entityConfig?: EntityConfig) {
    if (!name || typeof name !== 'string') {
      throw new Error(`cannot normalize without a schema.`);
    }
    this.name = name;
    this.primaryKey = entityConfig?.idAttribute ?? 'id';
    this.foreignKey = {};
    const foreignObj = entityParams ?? {};
    this.define(foreignObj);
  }
  define(entityParams: EntityParams) {
    this.foreignKey = entityParams;
  }
  getEntityName() {
    return this.name;
  }
  getForeignKey() {
    return this.foreignKey;
  }
  getPrimaryKey() {
    return this.primaryKey;
  }
  getId(input: Input) {
    return input[this.primaryKey];
  }
}
