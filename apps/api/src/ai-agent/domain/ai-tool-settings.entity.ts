import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
@Entity('ai_tool_settings')
export class AiToolSettingsEntity {
 @PrimaryColumn('uuid') tenant_id!:string;
 @PrimaryColumn('varchar',{length:100}) tool_name!:string;
 @Column('boolean') enabled!:boolean;
 @Column('uuid',{nullable:true}) updated_by!:string|null;
 @UpdateDateColumn({type:'timestamptz'}) updated_at!:Date;
}
