import { SetMetadata } from '@nestjs/common';
import { PERM_KEY, MODULE_KEY } from '../guards/roles.guard';

/** 声明某个接口需要的模块权限位，如 @RequirePerm('store', PERM.EDIT) */
export const RequirePerm = (module: string, perm: number) => (target: any, key: string, descriptor: PropertyDescriptor) => {
  SetMetadata(PERM_KEY, perm)(target, key, descriptor);
  SetMetadata(MODULE_KEY, module)(target, key, descriptor);
};
