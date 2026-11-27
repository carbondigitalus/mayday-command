// NPM Modules
import { IsInt, IsNotEmpty, IsString } from 'class-validator';
import 'reflect-metadata';

/** An uploaded file as the API returns it. The file itself is fetched from `GET /asset/:assetID`; its storage location
 * is never sent. */
export default class Asset {
    @IsNotEmpty()
    id?: string;

    /** The file's name as uploaded. */
    @IsString()
    fileName?: string;

    /** The file's type, detected from its contents. */
    @IsString()
    contentType?: string;

    /** The stored file's size in bytes. */
    @IsInt()
    size?: number;

    createdOn?: Date;
}
