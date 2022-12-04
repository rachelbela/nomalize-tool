import { schema, normalize, denormalize } from '../index';

describe('normalize', () => {
  [42, null, undefined, '42', () => {}].forEach((input: any) => {
    test(`cannot normalize input that == ${input}`, () => {
      expect(() => normalize(input, new schema.Entity('test'))).toThrow();
    });
  });

  test('cannot normalize without a schema', () => {
    expect(() => normalize({})).toThrow();
  });

  test('cannot normalize with null input', () => {
    const mySchema = new schema.Entity('tacos');
    expect(() => normalize(null, mySchema)).toThrow(/null/);
  });

  test('normalizes entities', () => {
    const mySchema = new schema.Entity('tacos');

    expect(
      normalize(
        [
          { id: 1, type: 'foo' },
          { id: 2, type: 'bar' },
        ],
        [mySchema],
      ),
    ).toMatchSnapshot();
  });

  test('normalizes entities with circular references', () => {
    const user = new schema.Entity('users');
    user.define({
      friends: [user],
    });

    const input: any = { id: 123, friends: [] };
    input.friends[0] = input;

    expect(normalize(input, user)).toMatchSnapshot();
  });

  test('normalizes nested entities', () => {
    const user = new schema.Entity('users');
    const comment = new schema.Entity('comments', {
      user: user,
    });
    const article = new schema.Entity('articles', {
      author: user,
      comments: [comment],
    });

    const input = {
      id: '123',
      title: 'A Great Article',
      author: {
        id: '8472',
        name: 'Paul',
      },
      body: 'This article is great.',
      comments: [
        {
          id: 'comment-123-4738',
          comment: 'I like it!',
          user: {
            id: '10293',
            name: 'Jane',
          },
        },
      ],
    };
    expect(normalize(input, article)).toMatchSnapshot();
  });

  test('does not modify the original input', () => {
    const user = new schema.Entity('users');
    const article = new schema.Entity('articles', { author: user });
    const input = Object.freeze({
      id: '123',
      title: 'A Great Article',
      author: Object.freeze({
        id: '8472',
        name: 'Paul',
      }),
    });
    expect(() => normalize(input, article)).not.toThrow();
  });

  test('ignores null values', () => {
    const myEntity = new schema.Entity('myentities');
    expect(normalize([null], [myEntity])).toMatchSnapshot();
    expect(normalize([undefined], [myEntity])).toMatchSnapshot();
    expect(normalize([false], [myEntity])).toMatchSnapshot();
  });

  //
  test('passes over pre-normalized values', () => {
    const userEntity = new schema.Entity('users');
    const articleEntity = new schema.Entity('articles', { author: userEntity });

    expect(normalize({ id: '123', title: 'normalizr is great!', author: 1 }, articleEntity)).toMatchSnapshot();
  });

  test('can normalize object without proper object prototype inheritance', () => {
    const test: any = { id: 1, elements: [] };
    test.elements[0] = Object.assign(Object.create(null), {
      id: 18,
      name: 'test',
    });

    const testEntity = new schema.Entity('test', {
      elements: [new schema.Entity('elements')],
    });

    expect(() => normalize(test, testEntity)).not.toThrow();
  });
});

describe('denormalize', () => {
  test('cannot denormalize without a schema', () => {
    expect(() => denormalize({})).toThrow();
  });

  test('returns the input if undefined', () => {
    expect(denormalize(undefined, {}, {})).toBeUndefined();
  });

  test('denormalizes entities', () => {
    const mySchema = new schema.Entity('tacos');
    const entities = {
      tacos: {
        1: { id: 1, type: 'foo' },
        2: { id: 2, type: 'bar' },
      },
    };
    expect(denormalize([1, 2], [mySchema], entities)).toMatchSnapshot();
  });

  test('denormalizes nested entities', () => {
    const user = new schema.Entity('users');
    const comment = new schema.Entity('comments', {
      user: user,
    });
    const article = new schema.Entity('articles', {
      author: user,
      comments: [comment],
    });

    const entities = {
      articles: {
        123: {
          author: '8472',
          body: 'This article is great.',
          comments: ['comment-123-4738'],
          id: '123',
          title: 'A Great Article',
        },
      },
      comments: {
        'comment-123-4738': {
          comment: 'I like it!',
          id: 'comment-123-4738',
          user: '10293',
        },
      },
      users: {
        10293: {
          id: '10293',
          name: 'Jane',
        },
        8472: {
          id: '8472',
          name: 'Paul',
        },
      },
    };
    expect(denormalize('123', article, entities)).toMatchSnapshot();
  });

  test('set to undefined if schema key is not in entities', () => {
    const user = new schema.Entity('users');
    const comment = new schema.Entity('comments', {
      user: user,
    });
    const article = new schema.Entity('articles', {
      author: user,
      comments: [comment],
    });

    const entities = {
      articles: {
        123: {
          id: '123',
          author: '8472',
          comments: ['1'],
        },
      },
      comments: {
        1: {
          user: '123',
        },
      },
    };
    expect(denormalize('123', article, entities)).toMatchSnapshot();
  });

  test('does not modify the original entities', () => {
    const user = new schema.Entity('users');
    const article = new schema.Entity('articles', { author: user });
    const entities = Object.freeze({
      articles: Object.freeze({
        123: Object.freeze({
          id: '123',
          title: 'A Great Article',
          author: '8472',
        }),
      }),
      users: Object.freeze({
        8472: Object.freeze({
          id: '8472',
          name: 'Paul',
        }),
      }),
    });
    expect(() => denormalize('123', article, entities)).not.toThrow();
  });
});
