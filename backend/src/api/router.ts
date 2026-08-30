import { Router } from 'express';
import { getTask } from '../store/taskRegistry';
import { getRunHistory } from '../store/runHistoryStore';

const router = Router();

router.get('/api/task/:taskId', async (req, res) => {
  const taskId = req.params.taskId;
  const task = await getTask(taskId);
  if (!task) {
    return res.status(404).send({ message: 'Task not found' });
  }
  const runHistory = await getRunHistory(taskId);
  const attempts = runHistory.map((attempt) => ({
    id: attempt.id,
    startTime: attempt.startTime,
    endTime: attempt.endTime,
    status: attempt.status,
  }));
  const cumulativeMetrics = runHistory.reduce((acc, attempt) => ({
    ...acc,
    duration: acc.duration + attempt.duration,
    cost: acc.cost + attempt.cost,
  }), {
    duration: 0,
    cost: 0,
  });
  return res.send({ ...task, attempts, cumulativeMetrics });
});

export default router;