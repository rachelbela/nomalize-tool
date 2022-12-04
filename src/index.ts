import { SchemaEntity } from './schema';
export const schema = {
  Entity: SchemaEntity,
};

interface Data {
  [propName: string]: any;
}
interface Input {
  [propName: string]: any;
}
interface Entity {
  name: string;
  primaryKey: string;
  foreignKey: Data;
  getId: (input: Input) => string;
  getEntityName: () => string;
  getForeignKey: () => string;
  getPrimaryKey: () => string;
  define: (entityParams: Data) => void;
}
type entity = Entity | Entity[];

type addEntityFunc = (entityName: string, id: string | number, value: Data) => void;

type addVisitedEntity = (entity: entity, data: Data) => void | string;

type addData = (key: string, data: Data) => void | string;

/**
 * 记录访问过的entity，避免循环引用
 */
const addVisitedEntities = (visitedEntities: Data) => (structor: any, input: Data) => {
  if (Array.isArray(structor)) {
    structor = structor[0];
  }
  const id = structor.getId(input);
  const entityType = structor.getEntityName();

  if (!(entityType in visitedEntities)) {
    visitedEntities[entityType] = {};
  }
  if (!(id in visitedEntities[entityType])) {
    visitedEntities[entityType][id] = [];
  }
  if (visitedEntities[entityType][id].some((entityData: any) => entityData === input)) {
    return id;
  }
  visitedEntities[entityType][id].push(input);
};

/**
 *
 * @param {*} entities 闭包保存需要逐渐丰富的对象
 * @returns
 */
const addEntities = (entities: Data) => (entityName: string, id: string | number, value: Data) => {
  if (!entities[entityName]) {
    entities[entityName] = {};
  }
  entities[entityName][id] = value;
};
/**
 * 递归调用函数，递归遍历schema对象
 * @param {*} schema
 * @param {*} addEntity
 * @param {*} data
 * @returns
 */
const visit = (definition: any, addEntity: addEntityFunc, checkVisitedEntity: addVisitedEntity, data: Data) => {
  const id = checkVisitedEntity(definition, data);
  if (id !== undefined) {
    return id;
  }
  if (definition.getEntityName === undefined) {
    // 1.entity非schame实体的

    return unEntityForeignKey(definition, addEntity, checkVisitedEntity, data);
  }
  // 2.entity是schema实体
  return entityForeignKey(definition, addEntity, checkVisitedEntity, data); // 第一步
};
/**
 *
 * @param {*} entity
 * @param {*} addEntity
 * @param {*} data
 * @returns schema实体的数据，返回的是id
 */

const entityForeignKey = (
  entityStructure: Data,
  addEntity: addEntityFunc,
  checkVisitedEntityFunc: addVisitedEntity,
  data: Data,
) => {
  const entityName = entityStructure.getEntityName();
  const primaryKey = entityStructure.getPrimaryKey();
  const currentEntity = entityStructure.getForeignKey(); // 递归遍历entity的外键
  if (Object.keys(currentEntity).length === 0) {
    // 遍历到没有外键为止
    const input = data;
    const id = entityStructure.getId(input); // 获得数据上对应的id
    addEntity(entityName, id, input);
    return id;
  } else {
    const processData = data[entityName] || data;
    Object.keys(currentEntity).forEach((key) => {
      const currentDataKey = key;
      const nextEntity = currentEntity[key];
      const currentData = data[currentDataKey];
      processData[currentDataKey] =
        typeof currentData === 'object'
          ? visit(nextEntity, addEntity, checkVisitedEntityFunc, currentData)
          : currentData; // 略过已经normalized的数据
    });
    const id = processData[primaryKey];
    addEntity(entityName, id, processData);
    return id;
  }
};
/**
 *
 * @param {*} entity
 * @param {*} addEntity
 * @param {*} data
 * @returns  非schema实体的数据，根据它是对象还是数组，返回对象或数组
 */

const unEntityForeignKey = (
  noEntityStructure: Data,
  addEntity: addEntityFunc,
  checkVisitedEntityFunc: addVisitedEntity,
  data: Data,
) => {
  const tag = Array.isArray(data);
  let id;
  if (tag) {
    const processEntity: string[] = [];
    Object.keys(noEntityStructure).forEach((key: any) => {
      const currentForeignKey = noEntityStructure[key];
      id = visit(currentForeignKey, addEntity, checkVisitedEntityFunc, data[key]);
      processEntity.push(id);
    });
    return processEntity;
  } else {
    const processEntity = { ...data };
    Object.keys(noEntityStructure).forEach((key) => {
      const currentDataKey = key;
      const currentData = data[key];
      const currentForeignKey = noEntityStructure[key];
      id = visit(currentForeignKey, addEntity, checkVisitedEntityFunc, currentData);
      processEntity[currentDataKey] = id;
    });
    return processEntity;
  }
};

export const normalize = (data: any, schemaEntity?: any) => {
  if (Object.prototype.toString.call(data) === '[object Null]') {
    throw new Error('null');
  }
  if (
    Object.prototype.toString.call(data) !== '[object Object]' &&
    Object.prototype.toString.call(data) !== '[object Array]'
  ) {
    throw new Error('cannot normalize input that data');
  }
  if (!schemaEntity) {
    throw new Error('cannot normalize without a schema');
  }
  const entities = {};
  const visitedEntities = {};
  const addEntity = addEntities(entities);
  const addVisitedEntityFunc = addVisitedEntities(visitedEntities);
  let validatedSchema: entity;
  let result;
  if (Array.isArray(schemaEntity)) {
    if (schemaEntity.length > 1) {
      throw new Error(`Expected schema definition to be a single schema, but found ${schemaEntity.length}.`);
    } else {
      validatedSchema = schemaEntity[0];
    }
  } else {
    validatedSchema = schemaEntity;
  }

  const copyData = Array.isArray(data) ? [...data] : { ...data }; // 拷贝一份，防止修改原始data对象
  if (Array.isArray(data)) {
    result = copyData.map((item: any) => (item ? visit(validatedSchema, addEntity, addVisitedEntityFunc, item) : item)); // 忽略null,undefined,false等
  } else {
    result = visit(validatedSchema, addEntity, addVisitedEntityFunc, copyData);
  }
  return {
    result,
    entities,
  };
};
const addData = (data: Data) => (key: string, value: Data) => {
  if (!data[key]) {
    data = value;
  } else {
    data[key] = value;
  }
};

const unvisit = (defination: Data, entities: any, processedData: any, add: addData, result: any) => {
  if (defination.getEntityName === undefined) {
    // 非schema实体
    return unschemaDenormalize(defination, entities, processedData, add, result);
  } else {
    return schemaDenormalize(defination, entities, processedData, add, result);
  }
};

const unschemaDenormalize = (defination: Data, entities: any, processedData: any, add: addData, result: any) => {
  let currentData: any;
  if (Array.isArray(processedData)) {
    currentData = [...processedData];
  } else {
    currentData = { ...processedData };
  }

  Object.keys(defination).forEach((key) => {
    let currentValue = processedData[key];
    let id;
    if (typeof currentValue !== 'object') {
      id = currentValue;
      currentValue = processedData;
    } else {
      id = result;
    }
    if (defination[key].getEntityName === undefined) {
      currentData[key] = unvisit(defination[key], entities, currentValue, add, id);
    } else {
      const currentEntity = defination[key].getForeignKey();
      currentData[key] = unvisit(defination[key], entities, currentValue, add, id);
    }
  });
  return Object.keys(currentData).length === 0 ? undefined : currentData;
};

const schemaDenormalize = (defination: Data, entities: any, processedData: any, add: addData, result: any) => {
  const key = defination.getEntityName();
  let value;
  if (!processedData[key]) {
    value = entities[key] !== undefined ? entities[key][result] : undefined;
  } else {
    value = processedData[key][result];
  }
  const currentEntity = defination.getForeignKey(); // {author:{...},comments:[...]}
  let processData = value;
  let id = result;
  if (typeof processData !== 'object') {
    id = processData;
  }
  const data = unvisit(currentEntity, entities, processData, add, id);
  processData = { ...processData, ...data };
  add(key, processData);
  return Object.keys(processData).length === 0 ? undefined : processData;
};

export const denormalize = (result?: any, initialEntity?: any, entities?: any) => {
  if (initialEntity === undefined) {
    throw new Error('cannot denormalize without a schema');
  }
  if (result === undefined) {
    return undefined;
  }
  const processData = { ...entities };
  const data = Array.isArray(result) ? [] : {};
  const addOriginalData = addData(data);
  const initialSchema = Array.isArray(initialEntity) ? initialEntity[0] : initialEntity;
  return Array.isArray(result)
    ? result.map((id) => unvisit(initialSchema, entities, processData, addOriginalData, id))
    : unvisit(initialSchema, entities, processData, addOriginalData, result);
};
