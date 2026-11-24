import { Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
export abstract class AiOwnedEntity {
 @PrimaryGeneratedColumn('uuid') id!:string;
 @Column('uuid') tenant_id!:string;
 @Column('uuid') user_id!:string;
 @CreateDateColumn({type:'timestamptz'}) created_at!:Date;
 @UpdateDateColumn({type:'timestamptz'}) updated_at!:Date;
}
