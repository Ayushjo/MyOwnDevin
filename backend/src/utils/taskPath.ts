import os from "os";
import path from "path"


export const getTaskPath = (taskId:string) => {
    return path.join(os.tmpdir(),'tasks',taskId);
}