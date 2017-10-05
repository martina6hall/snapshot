/*
  Copyright 2017 Google Inc. All Rights Reserved.
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at
      http://www.apache.org/licenses/LICENSE-2.0
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import FilterTransform from './filters/filter-transform';
import {IListRecord, imageDB} from './image-db';

enum ImageState {
  NotLoaded,
  Loaded,
  Changed,
}

export default class ImageRecord {
  static async fromDatabase(id: number) {
    const data = await imageDB.retrieveRecord(id);
    return ImageRecord.fromListRecord(data);
  }

  static fromListRecord(data: IListRecord) {
    const result = new ImageRecord();

    result.id = data.id;
    result.guid = data.guid;

    result.originalState = ImageState.NotLoaded;
    result.editedState = ImageState.NotLoaded;
    result.thumbnailState = ImageState.NotLoaded;

    result.originalId = data.originalId;
    result.editedId = data.editedId;
    result.thumbnailId = data.thumbnailId;

    result.transform = FilterTransform.from(data.transform);

    return result;
  }

  static async getAll(): Promise<ImageRecord[]> {
    const records = await imageDB.all();
    const result: ImageRecord[] = [];

    for (const record of records) {
      result.push(ImageRecord.fromListRecord(record));
    }

    return result;
  }

  id: number | null;
  guid: string;

  originalState: ImageState;
  editedState: ImageState;
  thumbnailState: ImageState;

  originalId: number | null;
  editedId: number | null;
  thumbnailId: number | null;

  transform: FilterTransform | null;

  private originalCache: Blob | null;
  private editedCache: Blob | null;
  private thumbnailCache: Blob | null;

  constructor() {
    this.id = null;
    this.guid = '';

    this.originalState = ImageState.Changed;
    this.editedState = ImageState.Changed;
    this.thumbnailState = ImageState.Changed;

    this.originalId = null;
    this.editedId = null;
    this.thumbnailId = null;

    this.transform = null;

    this.originalCache = null;
    this.editedCache = null;
    this.thumbnailCache = null;
  }

  async getOriginal(): Promise<Blob | null> {
    if (this.originalId && this.originalState === ImageState.NotLoaded) {
      this.originalCache = await imageDB.retrieveMedia(this.originalId);
      this.originalState = ImageState.Loaded;
    }

    return this.originalCache;
  }

  async getEdited(): Promise<Blob | null> {
    if (this.editedId && this.editedState === ImageState.NotLoaded) {
      this.editedCache = await imageDB.retrieveMedia(this.editedId);
      this.editedState = ImageState.Loaded;
    }

    return this.editedCache || this.getOriginal();
  }

  async getThumbnail(): Promise<Blob | null> {
    if (this.thumbnailId && this.thumbnailState === ImageState.NotLoaded) {
      this.thumbnailCache = await imageDB.retrieveMedia(this.thumbnailId);
      this.thumbnailState = ImageState.Loaded;
    }

    return this.thumbnailCache || this.getEdited();
  }

  setOriginal(media: Blob) {
    // TODO: If we set the original, we should wipe out/delete any edited/thumbnail versions too.
    this.originalCache = media;
    this.originalState = ImageState.Changed;
  }

  setEdited(media: Blob) {
    // TODO: If we set the edited, we should wipe out/delete any thumbnail version too.
    this.editedCache = media;
    this.editedState = ImageState.Changed;
  }

  async save(): Promise<void> {
    if (this.originalState === ImageState.Changed && this.originalCache !== null) {
      this.originalId = await imageDB.storeMedia(this.originalCache, this.originalId || undefined);
    }

    if (this.editedState === ImageState.Changed && this.editedCache !== null) {
      this.editedId = await imageDB.storeMedia(this.editedCache, this.editedId || undefined);
    }

    if (this.thumbnailState === ImageState.Changed && this.thumbnailCache !== null) {
      this.thumbnailId = await imageDB.storeMedia(this.thumbnailCache, this.thumbnailId || undefined);
    }

    let transformRecord: {[name: string]: number} = {};

    if (this.transform) {
      transformRecord = {...this.transform};
    }

    const id = await imageDB.storeRecord({
      editedId: this.editedId,
      guid: this.guid,
      id: this.id,
      originalId: this.originalId,
      thumbnailId: this.thumbnailId,
      transform: transformRecord,
    });
    this.id = id;
  }
}
